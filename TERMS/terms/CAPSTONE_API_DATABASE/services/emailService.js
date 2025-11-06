import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const defaultFromEmail = process.env.FROM_EMAIL;

export async function sendEmail({ to, subject, html, text, from }) {
	if (!resendApiKey) {
		throw new Error("RESEND_API_KEY is not set");
	}
	if (!from && !defaultFromEmail) {
		throw new Error("FROM_EMAIL is not set");
	}
	if (!to) {
		throw new Error("Missing 'to' email address");
	}

	const resend = new Resend(resendApiKey);
	const payload = {
		from: from || defaultFromEmail,
		to,
		subject: subject || "Test Email",
		text: text || undefined,
		html: html || undefined,
	};

	return await resend.emails.send(payload);
}

export async function healthCheckDomainStatus(targetDomainName) {
	if (!resendApiKey) {
		throw new Error("RESEND_API_KEY is not set");
	}
	const resend = new Resend(resendApiKey);
	const { data } = await resend.domains.list();
	if (!targetDomainName) return data;
	return data?.find((d) => d.name === targetDomainName);
}


