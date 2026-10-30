import { query } from "./_generated/server";

export const currentIdentity = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return {
      subject: identity.subject,
      name: identity.name,
      email: identity.email,
    };
  },
});
