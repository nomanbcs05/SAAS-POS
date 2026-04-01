import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold text-red-600">404 Error</h1>
      <p className="text-lg text-gray-600 mt-4">
        The page you are looking for does not exist.
      </p>
      <Link to="/" className="mt-6 text-blue-500 underline">
        Go back to Home
      </Link>
    </div>
  );
};

export default NotFound;
