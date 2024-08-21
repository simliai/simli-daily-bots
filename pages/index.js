import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1>Simli and Daily bots</h1>
      <Link href="/voice-chat">
        Start simli + daily bot interaction
      </Link>
    </div>
  );
}