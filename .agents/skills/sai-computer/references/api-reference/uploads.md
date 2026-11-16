# Upload

POST /v1/agents/upload

Uploads one file so a message can attach it. The body is the raw file; the name travels in a header.

## Request

```bash title="Upload a file"
curl -s "$SAI_API_URL/v1/agents/upload" \
  -H "Authorization: Bearer $SAI_API_KEY" \
  -H "x-filename: report.pdf" \
  --data-binary @./report.pdf
```

```python title="Upload a file"
from sai import Sai

sai = Sai()
attachment = sai.files.upload("./report.pdf", name="report.pdf")
print(attachment)
```

```typescript title="Upload a file"
import { Sai } from '@simular-ai/sai-sdk'

const sai = new Sai()
const attachment = await sai.files.upload('./report.pdf', { name: 'report.pdf' })
console.log(attachment)
```

```go title="Upload a file"
import (
	"context"
	"fmt"
	"log"
	"os"

	sai "github.com/simular-ai/sai-sdk/go"
)

ctx := context.Background()
client, err := sai.New(sai.Options{})
if err != nil {
	log.Fatal(err)
}
f, err := os.Open("./report.pdf")
if err != nil {
	log.Fatal(err)
}
defer f.Close()
attachment, err := client.Files.Upload(ctx, "report.pdf", f)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%+v\n", attachment)
```

```java title="Upload a file"
import ai.simular.sai.Attachment;
import ai.simular.sai.Sai;
import java.nio.file.Path;

Sai sai = new Sai();
Attachment attachment = sai.files().upload(Path.of("./report.pdf"), "report.pdf");
System.out.println(attachment);
```

```csharp title="Upload a file"
using Simular.Sai;

var sai = new SaiClient();
var attachment = await sai.Files.UploadAsync("./report.pdf", name: "report.pdf");
Console.WriteLine(attachment);
```

```ruby title="Upload a file"
require "sai"

sai = Sai::Client.new
attachment = sai.files.upload("./report.pdf", name: "report.pdf")
p attachment
```

| Header       | Required | Notes                                                                                |
| ------------ | -------- | ------------------------------------------------------------------------------------ |
| `x-filename` | yes      | URL-encoded original file name. The server derives the MIME type from its extension. |

The `Content-Type` header is ignored. Maximum size is 25 MB.

## Response

```json title="200 OK · Uploaded file"
{
  "path": "uploads/report-1790000000000.pdf",
  "name": "report-1790000000000.pdf",
  "mime": "application/pdf",
  "size": 48213,
  "fileId": "f_3kd9"
}
```

Pass this object unchanged as one entry of `attachments` on [`POST /message`](/documentation/api-reference/message).

## Recognised extensions

`.txt .md .json .js .ts .py .sh .bash .yaml .yml .csv .html .xml .pdf .png .jpg .jpeg .gif .webp .sim`

Anything else is stored as `application/octet-stream`.

## Errors

| Status | Body                                                              |
| ------ | ----------------------------------------------------------------- |
| `400`  | `{ "error": "x-filename header is required." }` or an empty body. |
| `402`  | `{ "error": "storage_balance_insufficient" }`                     |
| `409`  | `{ "error": "storage_quota_exceeded" }`                           |
| `413`  | `{ "error": "File too large. Maximum is 25MB." }`                 |
| `429`  | More than 30 uploads in an hour.                                  |
| `503`  | `{ "error": "storage_balance_unavailable" }`. Retry later.        |

## Gotchas

- The returned `name` can differ from the one you sent: unsafe characters are replaced and a timestamp is appended.
- One file per call. Loop for several.
- Use `--data-binary`, not `-d`, so curl does not strip newlines.
