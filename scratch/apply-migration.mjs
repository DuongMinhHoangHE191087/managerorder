import dotenv from "dotenv";
dotenv.config();

const projectRef = process.env.SUPABASE_PROJECT_REF;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

console.log("Project Ref:", projectRef);
console.log("Has Access Token:", !!accessToken);

async function run() {
  const query = `
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS icon_url TEXT;
    ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  `;

  console.log("Running SQL migration...");
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      read_only: false
    })
  });

  if (!res.ok) {
    console.error("Error status:", res.status);
    const text = await res.text();
    console.error("Error body:", text);
    return;
  }

  const data = await res.json();
  console.log("Success! Result:", data);
}

run().catch(console.error);
