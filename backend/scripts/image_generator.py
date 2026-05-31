import io
import os
from pathlib import Path

from dotenv import load_dotenv

# Load env from parent directory
load_dotenv(Path(__file__).parent.parent / ".env")

try:
    from google import genai
    from google.genai import types
    from PIL import Image
    from supabase import Client, create_client
except ImportError as e:
    print(f"❌ Missing dependencies: {e}")
    print("Run: pip install google-genai supabase pillow")
    raise

# Configuration
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")

if not GEMINI_API_KEY:
    print("⚠️ GEMINI_API_KEY missing")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️ Supabase credentials missing")

# Initialize Clients
def get_genai_client():
    return genai.Client(api_key=GEMINI_API_KEY)

def get_supabase_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

STYLE_PROMPT_SUFFIX = (
    " . Style: Flat vector art, simple shapes, vibrant colors, "
    "clean white background, cel shaded, suitable for children education app, "
    "Duolingo style illustration."
)

def generate_and_upload_image(prompt: str, filename: str, bucket: str = "lesson-assets") -> str:
    """
    Generates an image using Imagen 3, uploads to Supabase, returns Public URL.
    """
    full_prompt = prompt + STYLE_PROMPT_SUFFIX
    print(f"🎨 Generating: {prompt}...")

    client = get_genai_client()

    try:
        # Generate Image (Imagen 4 Fast - Latest)
        # Using model: imagen-4.0-fast-generate-001
        response = client.models.generate_images(
            model='imagen-4.0-fast-generate-001',
            prompt=full_prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="16:9" if "scene" in filename else "1:1"
            )
        )

        if not response.generated_images:
            print("❌ No images generated.")
            return ""

        # Get raw bytes
        image_bytes = response.generated_images[0].image.image_bytes

        # Optimize/Convert to PNG using Pillow (ensure format)
        img = Image.open(io.BytesIO(image_bytes))

        # Resize if huge? Imagen 3 outputs 1024x1024 usually. Good enough.
        # Convert to RGBA for standard
        if img.mode != 'RGBA' and img.mode != 'RGB':
            img = img.convert('RGB')

        out_io = io.BytesIO()
        img.save(out_io, format='PNG', optimize=True)
        out_bytes = out_io.getvalue()

        # Upload to Supabase
        sb = get_supabase_client()

        content_type = "image/png"
        path_on_storage = f"generated/{filename}.png"

        print(f"☁️ Uploading {len(out_bytes)/1024:.1f}KB to bucket '{bucket}/{path_on_storage}'...")

        try:
            res = sb.storage.from_(bucket).upload(
                path=path_on_storage,
                file=out_bytes,
                file_options={"content-type": content_type, "upsert": "true"}
            )
        except Exception as upload_err:
            if "Bucket not found" in str(upload_err) or "404" in str(upload_err):
                print(f"⚠️ Bucket '{bucket}' not found. Creating...")
                try:
                    sb.storage.create_bucket(bucket, options={"public": True})
                    # Retry upload
                    res = sb.storage.from_(bucket).upload(
                        path=path_on_storage,
                        file=out_bytes,
                        file_options={"content-type": content_type, "upsert": "true"}
                    )
                except Exception as create_err:
                    print(f"❌ Failed to create bucket: {create_err}")
                    return ""
            else:
                raise upload_err

        # Get Public URL
        public_url = sb.storage.from_(bucket).get_public_url(path_on_storage)
        print(f"✅ URL: {public_url}")

        return public_url

    except Exception as e:
        print(f"❌ Error generating/uploading image: {e}")
        return ""

if __name__ == "__main__":
    # Test run
    test_prompt = "A cute dinosaur superhero holding a gold coin"
    generate_and_upload_image(test_prompt, "test_dino_superhero")
