import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.hourly("review deadlines and reporting obligations", { minuteUTC: 23 }, internal.deadlines.tick, {});
crons.hourly("recover uncertain AI requests", { minuteUTC: 37 }, internal.ai.recover, {});
export default crons;
