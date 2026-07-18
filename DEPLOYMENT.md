# ByVit storage

The application keeps catalog data and uploaded media behind two small adapters:

- `BYVIT_STORAGE_DRIVER=file` stores JSON data.
- `BYVIT_MEDIA_DRIVER=file` stores uploaded images and videos.

By default both use `BYVIT_DATA_DIR` (or `RAILWAY_VOLUME_MOUNT_PATH` on Railway):

```text
data/store.json
data/backups/
data/uploads/
```

Recommended production variables:

```text
BYVIT_DATA_DIR=/data
BYVIT_STORAGE_PERSISTENT=true
BYVIT_MEDIA_PERSISTENT=true
BYVIT_UPLOAD_MAX_BYTES=26214400
```

Mount a persistent volume at `/data`. When moving to another host, copy `store.json`, `backups/`, and `uploads/`. Existing data URLs and external image links remain supported, so migration can be gradual.

The frontend only stores `/uploads/...` URLs. A future S3-compatible adapter can replace the file media driver without changing product, banner, brand, header, or footer forms.
