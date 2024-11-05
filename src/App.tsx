import { useEffect, useState } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';
import pako from 'pako';
import { parseMultipleJsonObjects } from './utils';
import { eventWithTime } from '@rrweb/types';

function App() {
  const [player, setPlayer] = useState<rrwebPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (player) {
      console.error('Player already exists. Please reload the page.');
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const text = new TextDecoder().decode(arrayBuffer);
      const isGzipped = uint8Array[0] === 0x1f && uint8Array[1] === 0x8b;
      let data: Array<{ events: eventWithTime[] }>;
      if (isGzipped) {
        const decompressed = pako.inflate(uint8Array, { to: 'string' });
        data = parseMultipleJsonObjects(decompressed);
      } else {
        data = parseMultipleJsonObjects(text);
      }

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
    } catch (err) {
      console.error('Error processing file:', err);
      setError(
        `Failed to process the file: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
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
      console.error(
        'No JSON URL provided. Please add a "url" query parameter.'
      );
      return;
    }

    fetch(jsonUrl, {
      headers: {
        Accept: 'application/json, application/gzip',
        'Content-Type': 'application/json',
      },
    })
      .then(async (response) => {
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        let data;
        try {
          data = JSON.parse(new TextDecoder().decode(arrayBuffer));
        } catch {
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
        setError(
          `Failed to load or parse the JSON file: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        );
      });

    return () => {
      playerContainer.innerHTML = '';
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      {error && (
        <div className="mb-2 text-red-600 bg-red-100 px-4 py-2 rounded-lg font-bold">
          {error}
        </div>
      )}
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

            <input
              type="file"
              accept=".gz"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleDrop({
                    preventDefault: () => {},
                    dataTransfer: {
                      files: [file],
                    },
                  } as unknown as React.DragEvent<HTMLDivElement>);
                }
              }}
              className="mt-4 block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-blue-50 file:text-blue-700
                            hover:file:bg-blue-100  border-blue-50 border-2 rounded-full p-1"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
