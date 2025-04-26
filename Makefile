# Makefile
.PHONY: install migrate makemigrations superuser runserver shell test clean flush

install:
	poetry install

migrate:
	poetry run python manage.py migrate

migrations:
	poetry run python manage.py makemigrations

superuser:
	poetry run python manage.py createsuperuser

runserver:
	poetry run python manage.py runserver

shell:
	poetry run python manage.py shell

test:
	poetry run python manage.py test

clean:
	find . -type d -name "__pycache__" -exec rm -r {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	find . -type d -name "*.egg-info" -exec rm -r {} +
	find . -type f -name "*.egg" -delete

flush:
	poetry run python manage.py flush

# Run all initial setup
setup: install migrate superuser

# Development commands combined
dev: clean migrate runserver