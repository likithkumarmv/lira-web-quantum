"""
ISO 6346 Container Number Check Digit Calculator & Validator
Follows international shipping container standard ISO 6346:1995.
"""

import re
from typing import Optional

# Character to numeric value mapping for ISO 6346
# Note: Multiples of 11 (11, 22, 33) are excluded to prevent mod 11 ambiguity
LETTER_VALUES = {
    'A': 10, 'B': 12, 'C': 13, 'D': 14, 'E': 15, 'F': 16, 'G': 17, 'H': 18, 'I': 19, 'J': 20,
    'K': 21, 'L': 23, 'M': 24, 'N': 25, 'O': 26, 'P': 27, 'Q': 28, 'R': 29, 'S': 30, 'T': 31,
    'U': 32, 'V': 34, 'W': 35, 'X': 36, 'Y': 37, 'Z': 38
}


def char_value(char: str) -> int:
    """Return numeric value for a character in ISO 6346."""
    c = char.upper()
    if c.isdigit():
        return int(c)
    if c in LETTER_VALUES:
        return LETTER_VALUES[c]
    raise ValueError(f"Invalid character '{char}' for ISO 6346 container number")


def calculate_check_digit(container_prefix_10: str) -> int:
    """
    Calculate the 11th digit (check digit) from the first 10 characters
    (4 letters + 6 digits).
    Formula: (Sum_{i=0..9} char_val(c_i) * 2^i) % 11 % 10
    """
    clean = re.sub(r"[^A-Za-z0-9]", "", container_prefix_10).upper()
    if len(clean) < 10:
        raise ValueError(f"Container prefix must have at least 10 alphanumeric characters: '{container_prefix_10}'")
    prefix = clean[:10]
    total = sum(char_value(c) * (2 ** i) for i, c in enumerate(prefix))
    rem = total % 11
    return rem % 10


def validate_container_no(container_no: str) -> bool:
    """
    Validate full 11-character container number against ISO 6346.
    4 letters + 6 digits + 1 check digit.
    """
    clean = re.sub(r"[^A-Za-z0-9]", "", container_no).upper()
    if len(clean) != 11:
        return False
    if not (clean[:4].isalpha() and clean[4:].isdigit()):
        return False
    try:
        expected = calculate_check_digit(clean[:10])
        actual = int(clean[10])
        return expected == actual
    except Exception:
        return False


def format_container_no(container_no: str) -> str:
    """Format container number canonically as 4-letters + 7-digits."""
    clean = re.sub(r"[^A-Za-z0-9]", "", container_no).upper()
    return clean

