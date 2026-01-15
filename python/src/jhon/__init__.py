"""JHON - JinHui's Object Notation parser and serializer."""

from jhon.jhon import (
    Parser,
    Serializer,
    parse,
    serialize,
    serialize_pretty,
    JhonParseError,
    remove_comments,
)

__all__ = [
    "Parser",
    "Serializer",
    "parse",
    "serialize",
    "serialize_pretty",
    "JhonParseError",
    "remove_comments",
]
__version__ = "1.0.0"
