"""
Comprehensive unit tests for JHON parser
"""

import unittest
import json
from jhon import parse, serialize, serialize_pretty, JhonParseError


class TestBasicParsing(unittest.TestCase):
    """Tests for basic parsing functionality."""

    def test_empty_input(self):
        result = parse("")
        self.assertEqual(result, {})

    def test_basic_key_value(self):
        result = parse('a="hello", b=123.45')
        self.assertEqual(result["a"], "hello")
        self.assertEqual(result["b"], 123.45)

    def test_string_types(self):
        result = parse('"quoted key"="value", unquoted_key="another"')
        self.assertEqual(result["quoted key"], "value")
        self.assertEqual(result["unquoted_key"], "another")

    def test_string_values(self):
        result = parse('text="simple string", empty="", spaces="  with  spaces  "')
        self.assertEqual(result["text"], "simple string")
        self.assertEqual(result["empty"], "")
        self.assertEqual(result["spaces"], "  with  spaces  ")

    def test_string_escaping(self):
        result = parse(r'newline="hello\nworld", backslash="path\\to\\file"')
        self.assertEqual(result["newline"], "hello\nworld")
        self.assertEqual(result["backslash"], r"path\to\file")

    def test_unicode_escape(self):
        result = parse('unicode="Hello\\u00A9World"')
        self.assertEqual(result["unicode"], "Hello©World")

    def test_numbers(self):
        result = parse("int=42, float=3.14, negative=-123")
        self.assertEqual(result["int"], 42)
        self.assertEqual(result["float"], 3.14)
        self.assertEqual(result["negative"], -123)

    def test_numbers_with_underscores(self):
        result = parse("large=100_000, million=1_000_000, decimal=1_234.567_890")
        self.assertEqual(result["large"], 100000)
        self.assertEqual(result["million"], 1000000)
        self.assertEqual(result["decimal"], 1234.56789)

    def test_booleans(self):
        result = parse("truth=true, falsehood=false")
        self.assertTrue(result["truth"])
        self.assertFalse(result["falsehood"])

    def test_null_value(self):
        result = parse("empty=null")
        self.assertIsNone(result["empty"])

    def test_empty_arrays(self):
        result = parse("empty=[]")
        self.assertEqual(result["empty"], [])

    def test_arrays_with_strings(self):
        result = parse('strings=["hello", "world", "test"]')
        self.assertEqual(result["strings"], ["hello", "world", "test"])

    def test_arrays_with_numbers(self):
        result = parse("numbers=[1, 2.5, -3, 4.0]")
        self.assertEqual(result["numbers"], [1, 2.5, -3, 4.0])

    def test_arrays_with_mixed_types(self):
        result = parse('mixed=["hello", 123, true, null, 45.6]')
        self.assertEqual(result["mixed"], ["hello", 123, True, None, 45.6])

    def test_multiline(self):
        result = parse("""
            name = "test",
            age = 25,
            active = true
        """)
        self.assertEqual(result["name"], "test")
        self.assertEqual(result["age"], 25)
        self.assertTrue(result["active"])

    def test_single_line_comments(self):
        result = parse("""
            // This is a comment
            name = "test"  // inline comment
            age = 25
        """)
        self.assertEqual(result["name"], "test")
        self.assertEqual(result["age"], 25)

    def test_multiline_comments(self):
        result = parse("""
            /* This is a
               multiline comment */
            name = "test"
        """)
        self.assertEqual(result["name"], "test")

    def test_trailing_commas(self):
        result = parse("name=\"test\", age=25, ")
        self.assertEqual(result["name"], "test")
        self.assertEqual(result["age"], 25)

    def test_array_trailing_commas(self):
        result = parse('items=["apple", "banana", "cherry", ]')
        self.assertEqual(result["items"], ["apple", "banana", "cherry"])

    def test_nested_objects(self):
        result = parse("server={host=\"localhost\", port=8080}")
        self.assertEqual(result["server"]["host"], "localhost")
        self.assertEqual(result["server"]["port"], 8080)

    def test_raw_strings(self):
        result = parse(r'path=r"C:\Windows\System32"')
        self.assertEqual(result["path"], r"C:\Windows\System32")

    def test_raw_strings_with_hashes(self):
        result = parse(r'contains_hash=r#"This has a " quote in it"#')
        self.assertEqual(result["contains_hash"], 'This has a " quote in it')

    def test_single_quoted_strings(self):
        result = parse("name='John', greeting='Hello'")
        self.assertEqual(result["name"], "John")
        self.assertEqual(result["greeting"], "Hello")

    def test_quotes_inside_strings(self):
        result = parse('text=\'He said "hello" to me\'')
        self.assertEqual(result["text"], 'He said "hello" to me')

    def test_quoted_keys_with_spaces(self):
        result = parse('"my key"="value", "another key"="test"')
        self.assertEqual(result["my key"], "value")
        self.assertEqual(result["another key"], "test")

    def test_complex_nested_structure(self):
        result = parse("""
            server = {
                host = "localhost",
                port = 3000,
                middleware = [
                    {name = "logger", enabled = true},
                    {name = "cors", enabled = false}
                ]
            }
        """)
        self.assertEqual(result["server"]["host"], "localhost")
        self.assertEqual(result["server"]["port"], 3000)
        self.assertEqual(len(result["server"]["middleware"]), 2)

    def test_deeply_nested_objects(self):
        result = parse("outer={inner={deep=\"value\"} number=42}")
        self.assertEqual(result["outer"]["inner"]["deep"], "value")
        self.assertEqual(result["outer"]["number"], 42)

    def test_arrays_in_objects(self):
        result = parse("data={items=[1, 2, 3] active=true}")
        self.assertEqual(result["data"]["items"], [1, 2, 3])
        self.assertTrue(result["data"]["active"])


class TestErrors(unittest.TestCase):
    """Tests for error handling."""

    def test_error_unterminated_string(self):
        with self.assertRaises(JhonParseError):
            parse('name="unclosed string')

    def test_error_expected_equals(self):
        with self.assertRaises(JhonParseError):
            parse('name "value"')

    def test_error_unterminated_array(self):
        with self.assertRaises(JhonParseError):
            parse('items=[1, 2, 3')

    def test_error_unterminated_nested_object(self):
        with self.assertRaises(JhonParseError):
            parse('server={host="localhost"')

    def test_error_invalid_boolean(self):
        with self.assertRaises(JhonParseError):
            parse('active=troo')

    def test_error_invalid_null(self):
        with self.assertRaises(JhonParseError):
            parse('value=nul')


class TestSerialization(unittest.TestCase):
    """Tests for serialization."""

    def test_serialize_basic_object(self):
        result = serialize({"name": "John", "age": 30})
        self.assertEqual(result, 'age=30,name="John"')

    def test_serialize_empty_object(self):
        result = serialize({})
        self.assertEqual(result, '')

    def test_serialize_string(self):
        result = serialize("hello world")
        self.assertEqual(result, '"hello world"')

    def test_serialize_string_with_escapes(self):
        result = serialize("line1\nline2\ttab")
        self.assertEqual(result, r'"line1\nline2\ttab"')

    def test_serialize_string_with_quotes(self):
        result = serialize('He said "hello"')
        self.assertEqual(result, r'"He said \"hello\""')

    def test_serialize_numbers(self):
        result = serialize({"int": 42, "float": 3.14, "negative": -123})
        self.assertEqual(result, 'float=3.14,int=42,negative=-123')

    def test_serialize_boolean(self):
        result = serialize({"active": True, "inactive": False})
        self.assertEqual(result, 'active=true,inactive=false')

    def test_serialize_null(self):
        result = serialize({"empty": None})
        self.assertEqual(result, 'empty=null')

    def test_serialize_array(self):
        result = serialize([1, 2, 3, "hello", True])
        self.assertEqual(result, '[1,2,3,"hello",true]')

    def test_serialize_empty_array(self):
        result = serialize([])
        self.assertEqual(result, '[]')

    def test_serialize_nested_object(self):
        result = serialize({"server": {"host": "localhost", "port": 8080}})
        self.assertEqual(result, 'server={host="localhost",port=8080}')

    def test_serialize_array_with_objects(self):
        result = serialize([
            {"name": "John", "age": 30},
            {"name": "Jane", "age": 25}
        ])
        self.assertEqual(result, '[{age=30,name="John"},{age=25,name="Jane"}]')

    def test_serialize_keys_with_special_chars(self):
        result = serialize({"my key": "value1", "key@symbol": "value2"})
        self.assertEqual(result, '"key@symbol"="value2","my key"="value1"')

    def test_serialize_round_trip_simple(self):
        original = {"name": "John", "age": 30, "active": True}
        serialized = serialize(original)
        parsed = parse(serialized)
        self.assertEqual(parsed["name"], original["name"])
        self.assertEqual(parsed["age"], original["age"])
        self.assertEqual(parsed["active"], original["active"])

    def test_serialize_round_trip_complex(self):
        original = {
            "app_name": "ocean-note",
            "version": "2.0.0",
            "database": {
                "host": "localhost",
                "port": 5432,
                "ssl": True
            },
            "features": ["markdown", "collaboration", "real-time"]
        }
        serialized = serialize(original)
        parsed = parse(serialized)
        self.assertEqual(parsed["app_name"], original["app_name"])
        self.assertEqual(parsed["database"]["host"], original["database"]["host"])


class TestPrettySerialization(unittest.TestCase):
    """Tests for pretty serialization."""

    def test_serialize_pretty_basic_object(self):
        result = serialize_pretty({"name": "John", "age": 30})
        self.assertEqual(result, 'age = 30,\nname = "John"')

    def test_serialize_pretty_nested_objects(self):
        result = serialize_pretty({"server": {"host": "localhost", "port": 8080}})
        self.assertEqual(result, 'server = {\n  host = "localhost",\n  port = 8080\n}')

    def test_serialize_pretty_array(self):
        result = serialize_pretty([1, 2, 3, "hello"])
        self.assertEqual(result, '[\n  1,\n  2,\n  3,\n  "hello"\n]')

    def test_serialize_pretty_array_with_objects(self):
        result = serialize_pretty([
            {"name": "John", "age": 30},
            {"name": "Jane", "age": 25}
        ])
        expected = '[\n  {\n    age = 30,\n    name = "John"\n  },\n  {\n    age = 25,\n    name = "Jane"\n  }\n]'
        self.assertEqual(result, expected)

    def test_serialize_pretty_round_trip(self):
        original = {
            "name": "John",
            "age": 30,
            "active": True,
            "tags": ["developer", "python"]
        }
        serialized = serialize_pretty(original)
        parsed = parse(serialized)
        self.assertEqual(parsed["name"], original["name"])
        self.assertEqual(parsed["age"], original["age"])
        self.assertEqual(parsed["tags"], original["tags"])


class TestJSONCompatibility(unittest.TestCase):
    """Tests for JSON compatibility."""

    def test_json_round_trip(self):
        original = {
            "app_name": "ocean-note",
            "version": "1.0.0",
            "debug": True,
            "features": ["markdown", "collaboration"]
        }

        # Serialize to JHON
        jhon_string = serialize(original)

        # Parse back
        parsed = parse(jhon_string)

        # Convert to JSON and back
        json_string = json.dumps(parsed)
        parsed_from_json = json.loads(json_string)

        self.assertEqual(parsed_from_json, original)

    def test_jhon_vs_json_size(self):
        data = {
            "app_name": "ocean-note",
            "version": "1.0.0",
            "debug": True,
            "database": {
                "host": "localhost",
                "port": 5432,
                "name": "mydb"
            },
            "features": ["markdown", "collaboration", "real-time"]
        }

        jhon_string = serialize(data)
        json_string = json.dumps(data, separators=(',', ':'))

        # JHON should be smaller or similar size
        print(f"\nJHON size: {len(jhon_string)} bytes")
        print(f"JSON size: {len(json_string)} bytes")
        print(f"JHON is {len(jhon_string) / len(json_string) * 100:.1f}% of JSON size")


class TestExampleFile(unittest.TestCase):
    """Test with the example file."""

    def test_example_file_parsing(self):
        jhon_input = """
        // Example JHON Configuration File
        app_name="ocean-note"
        version="1.0.0"
        debug=true

        // Database Configuration
        database={host="localhost",port=5432,name="mydb"}

        // Feature Flags
        features=["markdown","collaboration","real-time"]

        // Numeric Settings
        max_file_size=1048576
        timeout=30.5

        // Nested Objects
        server={host="0.0.0.0",port=3000,middleware=[{name="logger",enabled=true},{name="cors",enabled=false}]}

        // Keys with Hyphens
        log-level="info"
        cache-ttl=3600

        // Single and Double Quotes
        double_quoted="hello world"
        single_quoted='another value'

        // Raw String
        windows_path=r"C:\Windows\System32"

        // Null Value
        optional_config=null
        """

        result = parse(jhon_input)

        # Verify some values
        self.assertEqual(result["app_name"], "ocean-note")
        self.assertEqual(result["version"], "1.0.0")
        self.assertTrue(result["debug"])
        self.assertEqual(result["database"]["host"], "localhost")
        self.assertEqual(result["database"]["port"], 5432)
        self.assertEqual(result["features"], ["markdown", "collaboration", "real-time"])
        self.assertEqual(result["windows_path"], r"C:\Windows\System32")
        self.assertIsNone(result["optional_config"])


class TestComplexScenarios(unittest.TestCase):
    """Tests for complex scenarios."""

    def test_very_nested_structure(self):
        result = parse("""
            level1={
                level2={
                    level3={
                        deep="value"
                    }
                }
            }
        """)
        self.assertEqual(result["level1"]["level2"]["level3"]["deep"], "value")

    def test_multiple_arrays(self):
        result = parse("""
            arrays={
                strings=["a", "b", "c"]
                numbers=[1, 2, 3]
                mixed=[true, null, "text"]
            }
        """)
        self.assertEqual(result["arrays"]["strings"], ["a", "b", "c"])
        self.assertEqual(result["arrays"]["numbers"], [1, 2, 3])
        self.assertEqual(result["arrays"]["mixed"], [True, None, "text"])

    def test_empty_nested_objects(self):
        result = parse("empty={nested={}} another={}")
        self.assertEqual(result["empty"]["nested"], {})
        self.assertEqual(result["another"], {})

    def test_unicode_values(self):
        result = parse('text="Hello 世界 🌍" emoji="❤️"')
        self.assertEqual(result["text"], "Hello 世界 🌍")
        self.assertIn("❤", result["emoji"])


if __name__ == '__main__':
    unittest.main(verbosity=2)
