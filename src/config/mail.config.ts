import { registerAs } from "@nestjs/config";

export default registerAs("mail", () => {
  return{
    apiKey : process.env.RESEND_API_KEY,
    from : process.env.SENDER_EMAIL
  }
})