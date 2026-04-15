import React from 'react';
import Chatbot from '@site/src/components/Chatbot';

export default function Root({ children }) {
  return (
    <>
      {children}
      <Chatbot />
    </>
  );
}
