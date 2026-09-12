import { db } from "../src/lib/db";
import { OWNER_EMAILS } from "../src/lib/auth/owner";

let found = 0;
for (const email of OWNER_EMAILS) {
  const owner = await db.user.findUnique({ where: { email } });
  if (!owner) {
    console.log(`OWNER NOT FOUND: ${email}`);
  } else {
    found++;
    console.log(`owner found: ${owner.email} | role=${owner.role} | plan=${owner.plan} | hash head: ${owner.passwordHash.slice(0, 25)}`);
  }
}
if (found === 0) {
  console.log("Total users:", await db.user.count());
  console.log(await db.user.findMany({ select: { email: true, role: true } }));
}
process.exit(0);
