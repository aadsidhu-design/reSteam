import { Link } from 'react-router-dom'
import { Logo } from './ui'

export function About() {
  return (
    <div className="container about">
      <div className="about-hero"><Logo size={64} /><div><h1>About reSteam</h1><p className="muted">A fan-made recreation of a PC game store, built to study how that kind of site is put together.</p></div></div>
      <h2>What it is</h2>
      <p>reSteam recreates the look and behaviour of a digital game storefront: browsing and searching a catalog, wishlists and a cart, a library with installs and playtime, community hubs with reviews, discussions and guides, and a friends list with real-time chat.</p>
      <h2>What is real</h2>
      <p>Accounts, sign-in (including QR approval from another device), friends, presence, direct and group messages, notifications, reviews and discussions are all real and shared between people using this site. Passwords are hashed with a salted PBKDF2 and sessions use HttpOnly cookies.</p>
      <h2>What is not</h2>
      <p>Every game, studio and picture is fictional and generated in your browser. Wallet funds are play money and no payment is ever taken. Downloads are simulated; there is nothing to install. reSteam has no affiliation with any game store company.</p>
      <p><Link to="/store" className="btn blue">Browse the store</Link> <a className="btn" href="https://github.com/aadsidhu-design/resteam" target="_blank" rel="noreferrer">View the source</a></p>
    </div>
  )
}
