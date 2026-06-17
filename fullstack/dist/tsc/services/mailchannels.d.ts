interface EmailOptions {
    to: string;
    subject: string;
    htmlContent: string;
}
/**
 * Send email via MailChannels (free with Cloudflare Workers)
 * Requires the domain to have SPF record for mailchannels.net
 */
export declare function sendEmail(options: EmailOptions): Promise<boolean>;
/**
 * Build HTML email for PMQD analysis alert
 */
export declare function buildPMQDAlertEmail(stockName: string, stockCode: string, analysis: {
    pmqdTotal: number;
    pmqdStars: string;
    pmqdVerdict: string;
    kellyF: number;
    price: number;
    changePct: number;
    pe: number;
}): string;
export {};
//# sourceMappingURL=mailchannels.d.ts.map