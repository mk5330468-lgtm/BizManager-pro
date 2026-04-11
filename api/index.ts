import appPromise from './server.js';

export default async (req: any, res: any) => {
  // Simple ping test to verify function reachability
  if (req.url === '/api/ping') {
    return res.status(200).json({ message: 'pong', timestamp: new Date().toISOString() });
  }

  try {
    console.log(`[${new Date().toISOString()}] Vercel Function: Handling ${req.method} ${req.url}`);
    
    // Check for critical environment variables immediately
    if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
      console.error("CRITICAL: SUPABASE_URL is missing in Vercel environment.");
      return res.status(500).json({
        error: "Configuration Error",
        message: "SUPABASE_URL environment variable is missing. Please add it in Vercel Project Settings.",
        timestamp: new Date().toISOString()
      });
    }

    const app = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel Function Runtime Error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "An unexpected error occurred during request handling",
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
};
