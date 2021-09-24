# Rapid tests

Engaging Michelson interpreter to quickly check math soundness.
Powered by PyTezos.

## Prerequisites

Install cryptographic libraries according to your system following the instrucitons here:
https://pytezos.org/quick_start.html#requirements

## Installation

```
python3 -m pip install pytezos
```

## Usage
```
python3 -m pytest . -v -s
```

### For specific test
```
python3 -m pytest . -v -s -k <test-name>
```

### Generating initial storage for new contracts
```
pytezos storage --path=<contract.tz> -a default
```