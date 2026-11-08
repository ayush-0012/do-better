import { createApp } from "./app";
import { ENV } from "./env.server";
import { auth, db } from "./services";

const app = createApp({ auth, db, corsOrigin: ENV.CORS_ORIGIN, serverOrigin: ENV.SERVER_ORIGIN });

app.listen(ENV.PORT, "0.0.0.0", () => {
  console.log(`Server is listening on port ${ENV.PORT}`);
});
