import { Link } from 'react-router-dom'
import { Logo } from './ui'

export function About() {
  return (
    <div className="container about">
      <div className="about-hero"><Logo size={64} /><div><h1>About reSteam</h1><p className="muted">A fan-made recreation of a PC game store, built to study how that kind of site is put together.</p></div></div>
      <h2>Why it exists</h2>
      <p>reSteam gives developers access to systems they would not otherwise have, and the source code for them. A storefront with accounts, chat, community hubs, uploads and downloads is normally closed; here the whole stack is open, runs on a free Cloudflare account, and can be forked and changed.</p>
      <h2>Built with AI</h2>
      <p>This site was built with AI. Claude (Anthropic) wrote almost all of the code, tests and documentation through Claude Code, and did the analysis of the real store with reverse-engineering tools, under the owner's direction. Treat the code as AI-written: review it before relying on it, and note that translations have not been checked by native speakers. The full disclosure is in the project's README.</p>
      <h2>What it is</h2>
      <p>reSteam recreates the look and behaviour of a digital game storefront: browsing and searching a catalog, wishlists and a cart, a library with installs and playtime, community hubs with reviews, discussions and guides, and a friends list with real-time chat.</p>
      <h2>What is real</h2>
      <p>Accounts, sign-in (including QR approval from another device), friends, presence, direct and group messages, notifications, reviews and discussions are all real and shared between people using this site. Passwords are hashed with a salted PBKDF2 and sessions use HttpOnly cookies.</p>
      <h2>What is not</h2>
      <p>Every game, studio and picture is fictional and generated in your browser. Wallet funds are play money and no payment is ever taken. Downloads are simulated; there is nothing to install. reSteam has no affiliation with any game store company.</p>
      <p><Link to="/store" className="btn blue">Browse the store</Link></p>
    </div>
  )
}
