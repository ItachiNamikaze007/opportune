import { getSupabaseClient } from "./src/lib/supabase/client.ts";
import { appConfig } from "./src/lib/config.ts";

console.log("App Config:", appConfig);
const supabase = getSupabaseClient();
if (!supabase) {
  console.log("No supabase client configured.");
} else {
  const { data, error } = await supabase.from("opportunities").select("*");
  console.log("Supabase opportunities count:", data?.length, "Error:", error);
}
