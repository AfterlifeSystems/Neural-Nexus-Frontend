// src/components/Landing/Contact.jsx

import React, { useState } from 'react';
import { FaXTwitter, FaLinkedin, FaGithub } from 'react-icons/fa6'; // Modern Twitter & LinkedIn

import toast, { Toaster } from 'react-hot-toast';

export default function Contact() {
  const [name, setName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [message, setMessage] = useState('');

  const isEmailValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSend = () => {
    if (!name || !senderEmail || !message) {
      toast.error('All fields are required.');
      return;
    }

    if (!isEmailValid(senderEmail)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    const subject = encodeURIComponent(`Message from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${senderEmail}\n\nMessage:\n${message}`
    );
    const mailto = `mailto:contact@neuralnexus.site?subject=${subject}&body=${body}`;

    window.location.href = mailto;
  };

  return (
    <section id="contact" className="py-16 bg-neutral-100 text-neutral-800">
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Contact Us</h2>
        <div className="max-w-md mx-auto">
          <div>
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 mb-4 border focus:border-neutral-900 focus:ring-2 focus:ring-amber-400/50 focus:outline-none rounded transition-all"
            />
            <input
              type="email"
              placeholder="Email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="w-full p-2 mb-4 border focus:border-neutral-900 focus:ring-2 focus:ring-amber-400/50 focus:outline-none rounded transition-all"
            />
            <textarea
              placeholder="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-2 mb-4 border focus:border-neutral-900 focus:ring-2 focus:ring-amber-400/50 focus:outline-none rounded transition-all"
            ></textarea>
            <button
              type="button"
              onClick={handleSend}
              className="bg-black text-neutral-200 px-6 py-2 rounded-full w-full"
            >
              Send
            </button>
          </div>
          <div className="flex justify-center mt-4">
            {/* <a
              href="https://x.com/neuralnexus"
              className="mx-2 text-neutral-900 hover:text-neutral-500 transition"
            >
              <FaXTwitter />
            </a> */}
            {/* <a
              href="https://linkedin.com/company/neuralnexus"
              className="mx-2 text-neutral-900 hover:text-neutral-500 transition"
            >
              <FaLinkedin />
            </a> */}
            <a
              href="https://github.com/sponsors/efwoods"
              className="mx-2 text-neutral-900 hover:text-neutral-500 transition"
            >
              <FaGithub />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
