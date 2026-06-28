"""
JHON spec-conformance tests. Mirrors rust/src/lib.rs tests one-to-one so
behavior parity is verifiable. Run with `uv run pytest`.
"""

import pytest

from jhon import JhonParseError, parse, serialize, serialize_pretty


# =============================================================================
# §2 document form
# =============================================================================


def test_empty_input_parses_to_null():
    assert parse("") is None


def test_whitespace_only_input_parses_to_null():
    assert parse("   \n\t\r\n  ") is None


def test_comments_only_input_parses_to_null():
    assert parse("// just a comment\n/* block */") is None


def test_top_level_object_without_braces():
    assert parse('name="x",port=80') == {"name": "x", "port": 80}


def test_top_level_object_with_braces_is_single_element_array():
    # Per SPEC §2: top-level `{...}` is one element of the implicit array.
    assert parse('{name="x",port=80}') == [{"name": "x", "port": 80}]


def test_top_level_explicit_array_is_single_element_array():
    # Per SPEC §2: top-level `[...]` is one element of the implicit array.
    assert parse("[1, 2, 3]") == [[1, 2, 3]]


def test_top_level_scalar_number():
    assert parse("42") == [42]


def test_top_level_scalar_string():
    assert parse('"hello"') == ["hello"]


def test_top_level_scalar_boolean():
    assert parse("true") == [True]
    assert parse("false") == [False]


def test_top_level_scalar_null():
    assert parse("null") == [None]


def test_top_level_multiple_scalars_newline_separated():
    assert parse("1\n2\n3") == [1, 2, 3]


def test_top_level_multiple_scalars_comma_separated():
    assert parse('1,2,"haha"') == [1, 2, "haha"]


def test_top_level_mixed_scalars_and_object():
    # The example from the spec change request.
    assert parse('1\n2\n"haha"\n{a=4}') == [1, 2, "haha", {"a": 4}]


def test_top_level_multiple_objects():
    assert parse("{a=1}\n{b=2}") == [{"a": 1}, {"b": 2}]


def test_top_level_keyword_as_key_is_object_mode():
    # `true`, `false`, `null` in key position are strings.
    assert parse("true=1") == {"true": 1}


def test_top_level_numeric_key_is_object_mode():
    assert parse('42="x"') == {"42": "x"}


def test_top_level_quoted_string_key_is_object_mode():
    assert parse('"key"="value"') == {"key": "value"}


def test_top_level_mixed_pair_then_scalar_is_error():
    with pytest.raises(JhonParseError):
        parse("a=1\n2")


def test_top_level_mixed_scalar_then_pair_is_error():
    with pytest.raises(JhonParseError):
        parse("1\na=2")


def test_top_level_array_followed_by_pairs_is_error():
    with pytest.raises(JhonParseError):
        parse("[1, 2] key=value")


# =============================================================================
# §3.2 comments
# =============================================================================


def test_single_line_comment_trailing():
    assert parse('key="value" // trailing comment') == {"key": "value"}


def test_block_comment_inline():
    assert parse('key=/* inline */"value"') == {"key": "value"}


def test_block_comment_spanning_lines():
    assert parse('key=/* spans\nmultiple\nlines */"value"') == {"key": "value"}


def test_unterminated_block_comment_is_error():
    with pytest.raises(JhonParseError):
        parse("key=/* unterminated")


# =============================================================================
# §3.3 bare keys
# =============================================================================


def test_simple_identifier_key():
    assert parse('keyname="value"') == {"keyname": "value"}


def test_keyword_true_as_string_key():
    assert parse('true="yes"') == {"true": "yes"}


def test_keyword_false_as_string_key():
    assert parse('false="no"') == {"false": "no"}


def test_keyword_null_as_string_key():
    assert parse('null="nothing"') == {"null": "nothing"}


def test_key_with_hyphen():
    assert parse('my-key="value"') == {"my-key": "value"}


def test_key_with_underscore_and_digits():
    assert parse('key_1="value"') == {"key_1": "value"}


def test_key_with_dot():
    assert parse("app.version=1") == {"app.version": 1}


def test_unicode_key():
    assert parse('日本語="value"') == {"日本語": "value"}


def test_quoted_key_with_spaces():
    assert parse('"quoted key"="value"') == {"quoted key": "value"}


# =============================================================================
# §3.4 strings
# =============================================================================


def test_double_quoted_string():
    assert parse('key="value"') == {"key": "value"}


def test_single_quoted_string():
    assert parse("key='value'") == {"key": "value"}


def test_string_escape_newline_and_tab():
    assert parse(r'newline="hello\nworld",tab="tab\there"') == {
        "newline": "hello\nworld",
        "tab": "tab\there",
    }


def test_string_escape_unicode():
    assert parse('copy="©"') == {"copy": "©"}


def test_string_escape_quote_and_backslash():
    assert parse(r'q="say \"hi\"",bs="a\\b"') == {"q": 'say "hi"', "bs": "a\\b"}


def test_raw_string_basic():
    assert parse(r'path=r"C:\Windows\System32"') == {"path": "C:\\Windows\\System32"}


def test_raw_string_with_hashes():
    assert parse(r'q=r#"contains "quotes""#') == {"q": 'contains "quotes"'}


def test_unrecognized_escape_is_error():
    with pytest.raises(JhonParseError):
        parse(r'key="value\q"')


def test_unterminated_string_is_error():
    with pytest.raises(JhonParseError):
        parse('key="unterminated')


# =============================================================================
# §3.5 numbers
# =============================================================================


def test_decimal_integer():
    assert parse("n=42") == {"n": 42}


def test_negative_integer():
    assert parse("n=-5") == {"n": -5}


def test_number_with_underscores():
    assert parse("n=1_000_000") == {"n": 1_000_000}


def test_negative_number_with_underscores():
    assert parse("n=-50_000") == {"n": -50_000}


def test_float_fractional():
    assert parse("n=12.5") == {"n": 12.5}


def test_negative_float():
    assert parse("n=-45.67") == {"n": -45.67}


def test_float_with_exponent_only():
    assert parse("n=1e10") == {"n": 1e10}


def test_float_with_fractional_and_exponent():
    assert parse("n=1.5E-3") == {"n": 1.5e-3}


def test_hex_literal_lowercase():
    assert parse("n=0xff") == {"n": 255}


def test_hex_literal_uppercase_digits():
    assert parse("n=0xDE_AD") == {"n": 0xDE_AD}


def test_octal_literal():
    assert parse("n=0o777") == {"n": 0o777}


def test_binary_literal():
    assert parse("n=0b1010") == {"n": 0b1010}


def test_negative_hex_literal():
    assert parse("n=-0xff") == {"n": -255}


def test_positive_with_plus_prefix_is_error():
    with pytest.raises(JhonParseError):
        parse("n=+5")


def test_uppercase_hex_prefix_is_error():
    with pytest.raises(JhonParseError):
        parse("n=0Xff")


def test_uppercase_octal_prefix_is_error():
    with pytest.raises(JhonParseError):
        parse("n=0O77")


def test_uppercase_binary_prefix_is_error():
    with pytest.raises(JhonParseError):
        parse("n=0B10")


def test_number_type_suffix_is_error():
    with pytest.raises(JhonParseError):
        parse("n=5u8")


def test_leading_underscore_is_error():
    with pytest.raises(JhonParseError):
        parse("n=_5")


def test_trailing_underscore_is_error():
    with pytest.raises(JhonParseError):
        parse("n=5_")


def test_adjacent_underscores_are_error():
    with pytest.raises(JhonParseError):
        parse("n=5__5")


# =============================================================================
# §5 objects
# =============================================================================


def test_basic_key_value_pairs():
    assert parse('name="John",age=30,active=true') == {
        "name": "John",
        "age": 30,
        "active": True,
    }


def test_nested_object():
    assert parse('server={host="localhost", port=8080}') == {
        "server": {"host": "localhost", "port": 8080}
    }


def test_whitespace_around_equals_is_insignificant():
    assert parse("a=1, b = 2 , c=3") == {"a": 1, "b": 2, "c": 3}


def test_duplicate_keys_at_top_level_are_error():
    with pytest.raises(JhonParseError):
        parse("a=1, a=2")


def test_duplicate_keys_in_nested_object_are_error():
    with pytest.raises(JhonParseError):
        parse("outer={a=1, a=2}")


# =============================================================================
# §5.3 separators
# =============================================================================


def test_same_line_comma_separated():
    assert parse("a=1, b=2, c=3") == {"a": 1, "b": 2, "c": 3}


def test_newline_separated_multiline():
    assert parse("a=1\nb=2\nc=3") == {"a": 1, "b": 2, "c": 3}


def test_mixed_comma_and_newline_separators():
    assert parse("a=1,\nb=2,\nc=3") == {"a": 1, "b": 2, "c": 3}


def test_trailing_comma_at_top_level():
    assert parse("a=1, b=2,") == {"a": 1, "b": 2}


def test_trailing_comma_in_braced_object():
    # Per SPEC §2: top-level `{...}` is a single-element array.
    assert parse("{a=1, b=2,}") == [{"a": 1, "b": 2}]


def test_trailing_comma_in_array():
    # Per SPEC §2: top-level `[...]` is a single-element array.
    assert parse("[1, 2, 3,]") == [[1, 2, 3]]


def test_whitespace_around_comma_is_insignificant():
    assert parse("a=1,b=2, c=3 ,d=4") == {"a": 1, "b": 2, "c": 3, "d": 4}


def test_same_line_space_only_separator_is_error():
    with pytest.raises(JhonParseError):
        parse("a=1 b=2")


def test_same_line_tab_only_separator_is_error():
    with pytest.raises(JhonParseError):
        parse("a=1\tb=2")


def test_array_same_line_no_commas_is_error():
    with pytest.raises(JhonParseError):
        parse("[1 2 3]")


# =============================================================================
# §6 arrays
# =============================================================================


def test_empty_array():
    assert parse("items=[]") == {"items": []}


def test_array_of_strings():
    assert parse('items=["a", "b", "c"]') == {"items": ["a", "b", "c"]}


def test_array_mixed_types():
    assert parse('mixed=[1, "two", true, null]') == {"mixed": [1, "two", True, None]}


def test_nested_arrays():
    assert parse("nested=[[1, 2], [3, 4]]") == {"nested": [[1, 2], [3, 4]]}


def test_multiline_array_newline_separated():
    assert parse("list=[\n1\n2\n3\n]") == {"list": [1, 2, 3]}


def test_unbalanced_array_is_error():
    with pytest.raises(JhonParseError):
        parse("[1, 2, 3")


def test_unbalanced_braces_are_error():
    with pytest.raises(JhonParseError):
        parse("{a=1, b=2")


# =============================================================================
# §7 serialization
# =============================================================================


def test_compact_serialize_no_spaces_around_equals():
    assert serialize({"name": "John", "age": 30}) == 'name="John",age=30'


def test_compact_serialize_nested_object():
    assert serialize({"server": {"host": "localhost", "port": 8080}}) == (
        'server={host="localhost",port=8080}'
    )


def test_compact_serialize_top_level_array():
    # Top-level arrays serialize bare (no surrounding []).
    assert serialize([{"a": 1}, {"b": 2}]) == "{a=1},{b=2}"


def test_serialize_top_level_array_with_object():
    assert serialize([1, {"a": 2}]) == "1,{a=2}"


def test_serialize_empty_containers_and_null_to_empty_string():
    assert serialize({}) == ""
    assert serialize([]) == ""
    assert serialize(None) == ""


def test_serialize_nested_null_and_array_preserved():
    assert serialize({"a": None}) == "a=null"
    assert serialize({"a": [1, 2, 3]}) == "a=[1,2,3]"


def test_compact_serialize_has_no_trailing_comma():
    assert serialize({"a": 1, "b": 2, "c": 3}) == "a=1,b=2,c=3"


def test_pretty_serialize_spaces_around_equals_no_trailing_commas():
    assert serialize_pretty({"name": "John", "age": 30}) == 'name = "John"\nage = 30'


def test_pretty_serialize_nested_object():
    assert serialize_pretty({"server": {"host": "localhost", "port": 5432}}) == (
        'server = {\n  host = "localhost"\n  port = 5432\n}'
    )


def test_pretty_serialize_array_no_trailing_commas():
    # Top-level arrays serialize bare: one element per line, no [].
    assert serialize_pretty([1, 2, 3]) == "1\n2\n3"


def test_round_trip_compact_preserves_value():
    original = {
        "name": "John",
        "age": 30,
        "server": {"host": "localhost", "port": 5432},
    }
    assert parse(serialize(original)) == original


def test_round_trip_pretty_preserves_value():
    original = {
        "name": "John",
        "age": 30,
        "server": {"host": "localhost", "port": 5432},
    }
    assert parse(serialize_pretty(original)) == original


def test_hex_octal_binary_serialize_as_decimal():
    assert serialize({"hex": 0xFF, "oct": 0o777, "bin": 0b1010}) == (
        "hex=255,oct=511,bin=10"
    )


# =============================================================================
# Error positioning
# =============================================================================


def test_syntax_error_reports_line_and_column():
    with pytest.raises(JhonParseError) as ei:
        parse("a=1\nb=+5")
    err = ei.value
    assert err.line == 2
    assert err.column == 3
    assert "+" in err.message


def test_duplicate_key_error_reports_key():
    with pytest.raises(JhonParseError) as ei:
        parse("a=1, a=2")
    err = ei.value
    assert err.kind == "duplicate-key"
    assert err.duplicate_key == "a"


def test_unterminated_string_reports_eof():
    with pytest.raises(JhonParseError) as ei:
        parse('key="unfinished')
    err = ei.value
    assert "unterminated" in err.message.lower()
