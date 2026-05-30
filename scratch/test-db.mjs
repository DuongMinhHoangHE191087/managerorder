import dotenv from "dotenv";
dotenv.config();

const projectRef = process.env.SUPABASE_PROJECT_REF;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

console.log("Project Ref:", projectRef);
console.log("Has Access Token:", !!accessToken);

async function run() {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'short_links' ORDER BY column_name;",
      read_only: true
    })
  });

  if (!res.ok) {
    console.error("Error status:", res.status);
    const text = await res.text();
    console.error("Error body:", text);
    return;
  }

  const data = await res.json();
  console.log("Result:", data);
}

run().catch(console.error);
