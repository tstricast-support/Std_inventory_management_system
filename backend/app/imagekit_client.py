import os
import base64
import uuid
from dotenv import load_dotenv
from imagekitio import ImageKit
from imagekitio.models.UploadFileRequestOptions import UploadFileRequestOptions

load_dotenv()

imagekit = ImageKit(
    public_key=os.getenv("IMAGEKIT_PUBLIC_KEY"),
    private_key=os.getenv("IMAGEKIT_PRIVATE_KEY"),
    url_endpoint=os.getenv("IMAGEKIT_URL_ENDPOINT"),
)

def upload_image(file_bytes: bytes, filename: str):
    """Uploads raw image bytes to ImageKit and returns (url, file_id)."""
    unique_name = f"{uuid.uuid4().hex}_{filename}"
    result = imagekit.upload_file(
        file=base64.b64encode(file_bytes),
        file_name=unique_name,
        options=UploadFileRequestOptions(
            folder="/inventory-products/"
        )
    )
    return result.url, result.file_id


def delete_image(file_id: str):
    if file_id:
        imagekit.delete_file(file_id=file_id)