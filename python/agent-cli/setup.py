from setuptools import setup, find_packages

setup(
    name="fordefi-agent",
    version="0.1.0",
    description="Fordefi API client for AI agents - transfers, contract calls, and swaps",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "ecdsa>=0.19.0",
        "requests>=2.32.3",
    ],
)
