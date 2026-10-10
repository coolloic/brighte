import { saveMyData } from "@/lib/api/server";
import { chatConfig } from "@/lib/chat/server";
import { handleMyData } from "@/lib/my-data/server";

// Read once, when the server starts (root .env).
const config = chatConfig();

/** Saves a chat card (profile, tailored CV or cover letter) to "My data", under the profile's email. */
export function POST(request: Request) {
  return handleMyData(request, { enabled: config.myData, save: (input) => saveMyData(input, request.headers) });
}
