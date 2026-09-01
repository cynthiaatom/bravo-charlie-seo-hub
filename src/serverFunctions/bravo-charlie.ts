import { createServerFn } from "@tanstack/react-start";
import { BcHubService } from "@/server/features/bravo-charlie/services/BcHubService";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { createBravoCharlieClientSchema, issueBravoCharlieRegistrationCodeSchema } from "@/types/schemas/bravo-charlie";

export const getBravoCharlieClients = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => BcHubService.listClients(context.organizationId));

export const createBravoCharlieClient = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(createBravoCharlieClientSchema)
  .handler(async ({ data, context }) => BcHubService.createClient(context.organizationId, data));

export const issueBravoCharlieWpRegistrationCode = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(issueBravoCharlieRegistrationCodeSchema)
  .handler(async ({ data, context }) => BcHubService.issueWordPressRegistrationCode(context.organizationId, context.userId, data));
