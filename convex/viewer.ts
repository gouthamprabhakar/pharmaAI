import { query } from "./_generated/server";
import { requireIdentity } from "./lib/authorization";

export const currentIdentity = query({
  args: {},
  handler: async (ctx) => {
    if (!await ctx.auth.getUserIdentity()) return null;
    const identity = await requireIdentity(ctx);

    return {
      subject: identity.subject,
      name: identity.name,
      email: identity.email,
    };
  },
});
