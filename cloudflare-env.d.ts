declare namespace Cloudflare {
  interface Env {
    OPENAI_API_KEY?: string;
    OPENAI_VISION_MODEL?: string;
    OPENAI_PHOTO_DAILY_LIMIT?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
