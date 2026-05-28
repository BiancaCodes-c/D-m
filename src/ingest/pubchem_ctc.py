"""Chemistry ingestion placeholder for PubChem + EPA CTX data sources."""


def fetch_chemistry_stub() -> dict:
    """Return a placeholder payload until chemistry integration is added."""
    return {
        "status": "stub",
        "source": ["PubChem", "EPA CTX"],
        "message": "Chemistry integration not implemented yet.",
    }
