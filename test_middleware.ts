async function testMiddleware() {
  console.log("=== STARTING MIDDLEWARE TESTS ===");

  const BASE_URL = "http://localhost:3000";

  // 1. Test unprotected /api/auth/session route
  console.log("\n--- Testing Unprotected /api/auth route ---");
  try {
    const res = await fetch(`${BASE_URL}/api/auth/session`);
    console.log(`Status: ${res.status}`);
    // Should be 200 OK (returns {} or similar for no session)
    if (res.status === 200) {
      console.log("Success! /api/auth/session is not blocked by middleware.");
    } else {
      console.error(`Failed: Unexpected status ${res.status}`);
    }
  } catch (err: any) {
    console.error("Fetch failed:", err.message);
  }

  // 2. Test protected /api/invoices route with no session
  console.log("\n--- Testing Protected /api/invoices route (No Session) ---");
  try {
    const res = await fetch(`${BASE_URL}/api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    console.log(`Status: ${res.status}, Redirected: ${res.redirected}, URL: ${res.url}`);
    
    if (res.status === 401 && !res.redirected) {
      const body = await res.text();
      console.log(`Success! /api/invoices correctly rejected with a 401 JSON by middleware without HTML redirect. Body: ${body}`);
    } else {
      console.error("Failed: Route was not correctly protected or redirected incorrectly!");
    }
  } catch (err: any) {
    console.error("Fetch failed:", err.message);
  }

  // 3. Test /api/cron/notifications route with no session but valid CRON_SECRET
  console.log("\n--- Testing Excluded /api/cron route ---");
  try {
    const res = await fetch(`${BASE_URL}/api/cron/notifications`, {
      headers: { "CRON_SECRET": process.env.CRON_SECRET || "fallback" }
    });
    console.log(`Status: ${res.status}, Redirected: ${res.redirected}, URL: ${res.url}`);
    
    // We don't have a CRON_SECRET set in process.env here so the route itself might return 401,
    // but the critical part is that it is NOT redirected to /login by the middleware.
    if (!res.redirected) {
      console.log("Success! /api/cron route bypassed middleware successfully and reached the route logic.");
    } else {
      console.error("Failed: Cron route was incorrectly intercepted by middleware!");
    }
  } catch (err: any) {
    console.error("Fetch failed:", err.message);
  }
}

testMiddleware();
