"""Credential management for device access."""

import os
import yaml
import json
import logging
from typing import Dict, Optional
from pathlib import Path

from .models import CredentialSet


logger = logging.getLogger(__name__)


class CredentialManager:
    """Manages credentials for network devices."""

    def __init__(self, credential_file: str = None):
        """
        Initialize credential manager.

        Args:
            credential_file: Path to credentials file (optional)
        """
        self.credentials: Dict[str, CredentialSet] = {}

        # Try to load from file
        if credential_file and Path(credential_file).exists():
            self.load_from_file(credential_file)
        # Fall back to environment variables
        elif 'PATHTRACE_USER' in os.environ:
            self.load_from_env()

    def load_from_file(self, file_path: str):
        """
        Load credentials from file.

        Args:
            file_path: Path to credentials file (YAML or JSON)
        """
        logger.info(f"Loading credentials from {file_path}")

        with open(file_path, 'r') as f:
            if file_path.endswith('.yaml') or file_path.endswith('.yml'):
                data = yaml.safe_load(f)
            else:
                data = json.load(f)

        credentials_data = data.get('credentials', {})
        for name, cred_data in credentials_data.items():
            self.credentials[name] = CredentialSet(
                username=cred_data['username'],
                password=cred_data.get('password'),
                secret=cred_data.get('secret'),
                ssh_key_file=cred_data.get('ssh_key_file'),
                api_token=cred_data.get('api_token')
            )

        logger.info(f"Loaded {len(self.credentials)} credential sets")

    def load_from_env(self):
        """Load credentials from environment variables."""
        logger.info("Loading credentials from environment variables")

        username = os.getenv('PATHTRACE_USER')
        password = os.getenv('PATHTRACE_PASS')
        secret = os.getenv('PATHTRACE_SECRET')
        ssh_key = os.getenv('PATHTRACE_SSH_KEY')

        if username:
            self.credentials['default'] = CredentialSet(
                username=username,
                password=password,
                secret=secret,
                ssh_key_file=ssh_key
            )
            logger.info("Loaded default credentials from environment")

    def get_credentials(self, ref: str = 'default') -> Optional[CredentialSet]:
        """
        Get credentials by reference name.

        Args:
            ref: Credential reference name

        Returns:
            CredentialSet or None
        """
        return self.credentials.get(ref)

    def add_credentials(self, name: str, credentials: CredentialSet):
        """
        Add credential set.

        Args:
            name: Credential reference name
            credentials: CredentialSet to add
        """
        self.credentials[name] = credentials

    def has_credentials(self, ref: str = 'default') -> bool:
        """
        Check if credentials exist for reference.

        Args:
            ref: Credential reference name

        Returns:
            True if credentials exist
        """
        return ref in self.credentials
