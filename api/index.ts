import appPromise from './server';

export default async (req: any, res: any) => {
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel Function Startup Error:", error);
    res.status(500).json({
      error: "Internal Server Error during startup",
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      hint: "Check the Vercel logs for 'Vercel Function Startup Error' to see the full stack trace."
    });
  }
};
