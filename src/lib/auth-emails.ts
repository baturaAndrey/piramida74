/** Шаблоны писем Better Auth (inline-стили, без внешних ресурсов). */

export interface AuthEmail {
  subject: string
  html: string
  text: string
}

const SIGNATURE = "Бильярдный клуб «Пирамида»"

/** Экранирование для текста и значений атрибутов HTML. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export function passwordResetEmail(url: string): AuthEmail {
  const safeUrl = escapeAttr(url)

  const html = `<!DOCTYPE html>
<html lang="ru">
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:10px;padding:32px;">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:22px;">Сброс пароля</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">Чтобы задать новый пароль для входа в админку, нажмите на кнопку:</p>
      <p style="margin:0 0 24px;">
        <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#1f2937;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">Задать новый пароль</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280;">Если кнопка не работает, скопируйте ссылку в браузер:<br><span style="word-break:break-all;">${safeUrl}</span></p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">Ссылка действует 1 час. Если вы не запрашивали сброс — проигнорируйте письмо.</p>
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">${SIGNATURE}</p>
    </td></tr>
  </table>
</body>
</html>`

  const text = [
    "Сброс пароля",
    "",
    "Чтобы задать новый пароль для входа в админку, перейдите по ссылке:",
    url,
    "",
    "Ссылка действует 1 час. Если вы не запрашивали сброс — проигнорируйте письмо.",
    "",
    SIGNATURE,
  ].join("\n")

  return { subject: "Сброс пароля — админка «Пирамида»", html, text }
}
