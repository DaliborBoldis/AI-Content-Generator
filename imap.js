import Imap from "imap";
import { simpleParser } from "mailparser";
import { config } from "dotenv";
config();

class EmailFetcher {
	constructor() {
		this.imap = new Imap({
			user: process.env.imap_user,
			password: process.env.imap_password,
			host: "",
			port: 993,
			tls: true,
		});
	}

	async fetchEmails() {
		return new Promise((resolve, reject) => {
			const emails = [];

			const handleMsg = (msg) => {
				let email = {};
				let body = "";
				msg.on("body", (stream) => stream.on("data", (chunk) => (body += chunk.toString("utf8"))));
				msg.once("attributes", (attrs) => (email.uid = attrs.uid));
				msg.once("end", () =>
					simpleParser(body, async (err, mail) => {
						if (err) reject(new Error(err.message));

						const attachments =
							mail.attachments?.map((a) => ({
								filename: a.filename,
								contentType: a.contentType,
								length: a.length,
								content: a.content,
							})) || [];

						emails.push({
							uid: email.uid,
							msg_id: mail.headers.get("message-id"),
							date: mail.headers.get("date"),
							subject: mail.subject,
							from: mail.headers.get("from").text,
							to: mail.headers.get("to").text,
							body: mail.text,
							html: mail.html,
							attachments,
						});
					})
				);
			};

			const openInbox = (cb) => {
				try {
					this.imap.openBox("INBOX", false, cb);
				} catch (err) {
					reject(new Error(`fetchEmails: ${err.message}`));
				}
			};

			this.imap.once("ready", () =>
				openInbox((err) => {
					if (err) reject(new Error(err.message));
					const f = this.imap.seq.fetch("1:*", {
						bodies: "",
						struct: true,
						uid: true,
					});
					f.on("message", handleMsg);
					f.once("error", (err) => reject(new Error(err.message)));
					f.once("end", () => {
						this.imap.end();
					});
				})
			);
			this.imap.once("error", (err) => reject(new Error(err.message)));
			this.imap.once("end", () => resolve(emails));
			this.imap.connect();
		});
	}

	/**
	 * Archives an email from the inbox.
	 *
	 * @param {string} uid - The unique identifier for the email to be archived.
	 *
	 * @throws {Error} Throws an error if the archiving process fails.
	 *
	 * @returns {Promise} Returns a promise that resolves when the email is successfully archived.
	 */
	async ArchiveEmail(uid) {
		console.log("Archiving email: " + uid);

		try {
			await new Promise((resolve, reject) => {
				imap.once("ready", function () {
					this.imap.openBox("INBOX", false, function (err) {
						if (err) reject(err);

						this.imap.move(uid, "Archive", (err) => {
							if (err) reject(`Failed to move email to email: ${err}`);

							resolve();

							this.imap.end(); // Closing the IMAP connection after moving the email
						});
					});
				});

				this.imap.connect(); // Initiating the IMAP connection
			});
		} catch (error) {
			reject(`Failed to archive email: ${error}`);
		}
	}
}

export default EmailFetcher;
