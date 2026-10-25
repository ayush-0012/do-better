import { createApp } from "./app";
import { ENV } from "./env.server";
import { auth } from "./services";

const app = createApp({ auth, corsOrigin: ENV.CORS_ORIGIN });

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
