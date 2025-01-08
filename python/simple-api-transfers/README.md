# Fordefi API Code Examples

Example Python scripts showing how to transfer value from your Fordefi Vaults using the Fordefi API.

## Prerequisites

1. Create a Fordefi API user and setup an API Signer ([tutorial](https://docs.fordefi.com/developers/program-overview)) 

2. Install `uv` package manager:
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

3. Set up the project:
   ```bash
   git clone <repository-url>
   cd <repository-name>
   uv sync
   ```

4. Configure environment variables:
   Create a `.env` file in the root directory with your Fordefi API user token and your default Vault IDs:
   ```plaintext
   EVM_VAULT_ID="your_vault_id"
   FORDEFI_API_TOKEN="your_api_user_token"
   ```

5. Place your API Signer's `.pem` private key file in a `/secret` directory at the root of this project.

6. Open Docker and start the Fordefi API Signer:
   ```bash
   docker run --rm --log-driver local --mount source=vol,destination=/storage -it fordefi.jfrog.io/fordefi/api-signer:latest
   ```
   Then select "Run signer" in the Docker container.

## Usage

1. Select a script, modify the `## CONFIG` section with your desired parameters:
   - `evm_chain`
   - `destination`
   - `custom_note`
   - `value`
   Then save the file.

2. Run `uv run <script_name>.py`