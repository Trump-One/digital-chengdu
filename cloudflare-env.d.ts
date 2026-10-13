declare namespace Cloudflare {
  interface Env {
    OPENROUTER_API_KEY?: string;
    OPENROUTER_VISION_MODEL?: string;
    PHOTO_DAILY_LIMIT?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
