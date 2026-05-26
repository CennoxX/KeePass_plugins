# KeePass Plugins
This repository provides a continuously updated, structured catalog of the KeePass plugins.

It collects the plugin information from the official [KeePass plugin page](https://keepass.info/plugins.html) and enriches it with additional metadata such as download links and versions from GitHub and SourceForge.

---

## Output
The result is a single file, [plugins.json](plugins.json), containing all plugins in a normalized, machine-readable format.

---

## Plugin structure
Each plugin in `plugins.json` looks like this:

```json
{
  "id": "exampleplugin",
  "title": "Example Plugin",
  "shortdesc": "Short description of the plugin.",
  "authors": ["Author Name"],
  "language": ["English"],
  "description": "Full plugin description.",
  "similar": ["otherplugin"],
  "group": "Utilities",
  "sourceCode": "https://github.com/example/repo",
  "download": "https://github.com/example/repo/releases/latest/download/{major}.{minor}.{patch}.plgx",
  "website": "https://example.com",
  "updateUrl": "https://example.com/version.txt",
  "version": "1.0.0"
}
```

### Fields
| Field       | Description              |
| ----------- | ------------------------ |
| id          | Unique plugin identifier |
| title       | Display name             |
| shortdesc   | Brief one-line summary   |
| authors     | List of contributors     |
| language    | Supported languages      |
| description | Full plugin description  |
| similar     | Related plugin IDs       |
| group       | Plugin category          |
| sourceCode  | Source repository URL    |
| download    | Direct download link     |
| website     | Plugin homepage          |
| updateUrl   | Version check URL        |
| version     | Latest known version     |

## License
This project is licensed under the [MIT License](LICENSE).
