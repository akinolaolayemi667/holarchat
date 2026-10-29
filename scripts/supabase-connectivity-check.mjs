const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

if (!url || !key) {
  console.error("Supabase URL or public key is missing.");
  process.exit(1);
}

try {
  const response = await fetch(`${url}/auth/v1/health`, {
    headers: {
      apikey: key,
    },
    signal: AbortSignal.timeout(10000),
  });

  console.log("HTTP status:", response.status);
  console.log(
    "Supabase authentication endpoint:",
    response.ok ? "reachable" : "returned an error",
  );
} catch (error) {
  console.error("Connection failed:", error.message);
  process.exitCode = 1;
}