const urls = [
    "https://youtu.be/n2FyZwVvAX4",
    "https://youtu.be/VWRlFTw6QfI",
    "https://youtu.be/j2OxFmVgyGo",
    "https://youtu.be/9F3Jc5Xe4w8",
    "n2FyZwVvAX4", // Raw ID case
    "https://www.youtube.com/watch?v=n2FyZwVvAX4", // Standard URL
    "https://www.youtube.com/embed/n2FyZwVvAX4", // Embed URL
];

const getYoutubeId = (url) => {
    if (!url) return '';
    // The regex from Projects.ts
    const match = url.match(/(?:\?v=|\/embed\/|\/1\/|\/v\/|https:\/\/youtu\.be\/|\/7\/|watch\?v=|^)([a-zA-Z0-9_-]{11})(?:\?|&|$|\s)/);
    return match ? match[1] : null;
};

urls.forEach(url => {
    console.log(`URL: ${url} -> ID: ${getYoutubeId(url)}`);
});
