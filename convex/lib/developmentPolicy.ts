export function developmentMfaOptional(settings: Record<string, string | undefined> = process.env) {
  return settings.PHARMAAI_ENVIRONMENT === "development"
    && settings.PHARMAAI_DEVELOPMENT_MFA_OPTIONAL === "true"
    && /^https:\/\/[a-z0-9-]+\.clerk\.accounts\.dev\/?$/.test(settings.CLERK_JWT_ISSUER_DOMAIN ?? "");
}
