declare module "html-to-text"
declare module "mailparser"

declare namespace Express {
  interface Request {
    user?: { id: string; username: string | null; name: string }
  }
}
