# OMDB API Integration Guide

## Overview
This movie library now includes integration with the OMDB API (Open Movie Database) to automatically fetch movie posters from IMDB.

## Getting Your Free OMDB API Key

1. **Visit OMDB API**: Go to https://www.omdbapi.com/apikey.aspx
2. **Register for Free**: Fill out the registration form
   - Choose "FREE" tier (1000 daily requests)
   - Provide your email and a brief description
3. **Check Your Email**: You'll receive your API key within a few minutes
4. **Copy Your API Key**: It will look something like: `abcd1234`

## Configuration

1. Open `omdb-api.php` in your text editor
2. Find line 24:
   ```php
   $omdbApiKey = 'YOUR_OMDB_API_KEY_HERE';