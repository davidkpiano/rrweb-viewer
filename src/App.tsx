import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import pako from 'pako';

function parseMultipleJsonObjects(text: string): Array<{
  events: any[];
}> {
  const results = [];
  let startIndex = 0;

  // Find all potential split points
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === '}' && text[i + 1] === '{') {
      try {
        // Try parsing from start to this point
        const chunk = text.substring(startIndex, i + 1);
        JSON.parse(chunk); // If this succeeds, we found a valid split point

        results.push(JSON.parse(chunk));
        startIndex = i + 1;
      } catch {
        // Not a valid split point, continue searching
        continue;
      }
    }
  }

  // Don't forget the last chunk
  if (startIndex < text.length) {
    const lastChunk = text.substring(startIndex);
    results.push(JSON.parse(lastChunk));
  }

  return results;
}

function App() {
  const [player, setPlayer] = useState<rrwebPlayer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      console.log(arrayBuffer);
      const uint8Array = new Uint8Array(arrayBuffer);
      console.log(uint8Array);

      const text = new TextDecoder().decode(arrayBuffer);
      console.log(text);

      // Check for gzip magic numbers (1f 8b)
      const isGzipped = uint8Array[0] === 0x1f && uint8Array[1] === 0x8b;
      console.log({ isGzipped });

      let data;
      if (isGzipped) {
        const decompressed = pako.inflate(uint8Array, { to: 'string' });
        data = parseMultipleJsonObjects(decompressed);
      } else {
        // Try parsing as regular JSON
        data = parseMultipleJsonObjects(new TextDecoder().decode(arrayBuffer));
      }

      console.log(data);

      const events = data.map((obj) => obj.events).flat();
      if (!Array.isArray(events)) {
        throw new Error('The file does not contain an array of events.');
      }
      if (events.length === 0) {
        throw new Error('The file contains an empty array of events.');
      }
      if (!events[0].type || typeof events[0].timestamp !== 'number') {
        throw new Error('The file does not contain valid rrweb events.');
      }

      const playerContainer = document.getElementById('player-container')!;
      // playerContainer.innerHTML = '';

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
      setError(null);
    } catch (err: any) {
      console.error('Error processing file:', err);
      setError(`Failed to process the file: ${err.message}`);
    }
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (
      file &&
      (file.name.endsWith('.gz') || file.type === 'application/gzip')
    ) {
      handleFile(file);
    } else {
      setError('Please drop a gzip file.');
    }
  };

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
      // mode: 'no-cors',
    })
      .then(async (response) => {
        const contentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        let data;
        try {
          // Try parsing as JSON first
          data = JSON.parse(new TextDecoder().decode(arrayBuffer));
        } catch {
          // If JSON parsing fails, try decompressing as gzip
          const decompressed = pako.inflate(uint8Array, { to: 'string' });

          data = JSON.parse(decompressed);
        }

        return data;
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

  // if (error) {
  //   return (
  //     <div className="min-h-screen bg-gray-100 flex items-center justify-center">
  //       <div className="bg-white p-8 rounded-lg shadow-md max-w-lg w-full">
  //         <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
  //         <p className="text-gray-700 mb-4">{error}</p>
  //         <p className="text-sm text-gray-500">
  //           Please check the console for more detailed error information.
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div
        id="player-container"
        className={`bg-white rounded-lg shadow-lg overflow-hidden ${
          !player
            ? 'min-h-[576px] min-w-[1024px] flex items-center justify-center'
            : ''
        } ${isDragging ? 'border-4 border-blue-500 border-dashed' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!player && (
          <div className="text-gray-500 text-center p-8">
            <p className="text-xl mb-2">Drop your .gz file here</p>
            <p className="text-sm">or use the URL parameter</p>
          </div>
        )}
      </div>
      {player && (
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
      )}
    </div>
  );
}
export default App;
