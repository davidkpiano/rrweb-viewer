import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import pako from 'pako';

function App() {
  const [player, setPlayer] = useState<rrwebPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const jsonUrl = urlParams.get('url') ?? '';
    const playerContainer = document.getElementById('player-container')!;

    if (!jsonUrl) {
      setError('No JSON URL provided. Please add a "url" query parameter.');
      return;
    }

    fetch(jsonUrl, {
      headers: {
        Accept: 'application/json, application/gzip',
        'Content-Type': 'application/json',
      },
      mode: 'cors',
    })
      .then(async (response) => {
        const contentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();

        if (jsonUrl.endsWith('.gz') || contentType?.includes('gzip')) {
          const uint8Array = new Uint8Array(arrayBuffer);
          const decompressed = pako.inflate(uint8Array, { to: 'string' });
          return JSON.parse(decompressed);
        }
        return JSON.parse(new TextDecoder().decode(arrayBuffer));
      })
      .then((data) => {
        const events = data.events;
        if (!Array.isArray(events)) {
          throw new Error('The JSON file does not contain an array of events.');
        }

        if (events.length === 0) {
          throw new Error('The JSON file contains an empty array of events.');
        }

        if (!events[0].type || typeof events[0].timestamp !== 'number') {
          throw new Error('The JSON file does not contain valid rrweb events.');
        }

        console.log('First event:', events[0]);
        console.log('Total events:', events.length);

        const newPlayer = new rrwebPlayer({
          target: playerContainer,
          props: {
            events,
            width: 1024,
            height: 576,
            autoPlay: false,
          },
        });
        setPlayer(newPlayer);
      })
      .catch((err) => {
        console.error('Error loading or parsing JSON:', err);
        setError(`Failed to load or parse the JSON file: ${err.message}`);
      });

    return () => {
      // delete playerContainer's children
      playerContainer.innerHTML = '';
    };
  }, []);

  const handlePlayPause = () => {
    if (player) {
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleRestart = () => {
    if (player) {
      player.goto(0);
      player.play();
      setIsPlaying(true);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-lg w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Please check the console for more detailed error information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div
        id="player-container"
        className="bg-white rounded-lg shadow-lg overflow-hidden"
      ></div>
      <div className="mt-6 flex space-x-4">
        <button
          onClick={handlePlayPause}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex items-center"
        >
          {isPlaying ? <Pause className="mr-2" /> : <Play className="mr-2" />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={handleRestart}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded flex items-center"
        >
          <RotateCcw className="mr-2" />
          Restart
        </button>
      </div>
    </div>
  );
}

export default App;
