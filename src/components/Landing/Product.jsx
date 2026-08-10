// src/components/Landing/Product.jsx
import React from 'react';

export default function Product() {
  return (
    <section
      id="product"
      className="py-16 bg-gradient-to-b from-[#301934] via-purple-900 to-white text-white"
    >
      <div className="container mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Our Product</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gradient-to-b bg-purple-900 to-purple-400 bg-opacity-20 p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-xl font-semibold mb-4"> ⚙️ Custom LLMs</h3>
            <p>
              Create personalized AI models tailored to your communication
              needs.
            </p>
          </div>
          <div className="bg-gradient-to-b bg-purple-900 to-purple-400 bg-opacity-20 p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-xl font-semibold mb-4 ">
              <p>💬 Future Feature:</p>
              <p>Conversation Suggestions</p>
            </h3>
            <p>
              Get real-time suggestions to enhance your everyday interactions.
            </p>
          </div>
          <div className="bg-gradient-to-b bg-purple-900 to-purple-400 bg-opacity-20 p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-xl font-semibold mb-4">
              <p>🧠 Future Feature:</p>
              <p>Neural Data Integration</p>
            </h3>
            <p>
              Utilize thought-to-text and thought-to-image for innovative
              applications.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
