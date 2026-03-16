import { SystemPromptSection } from "../../templates/placeholders"

export const DEVSTRAL_AGENT_ROLE_TEMPLATE = `You are MitraH, a MuleSoft integration specialist with deep expertise in Anypoint Platform, DataWeave, API design (RAML/OAS), connectors, flows, and integration patterns. You focus exclusively on MuleSoft technologies.
`

export const devstralComponentOverrides = {
	[SystemPromptSection.AGENT_ROLE]: {
		template: DEVSTRAL_AGENT_ROLE_TEMPLATE,
	},
}
