export const config = {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || "development",
    allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",")
        : ["http://localhost:3000"],
};

