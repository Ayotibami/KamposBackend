"""
Email utilities for sending emails from different accounts
"""
import os
from django.core.mail import EmailMessage, EmailMultiAlternatives, get_connection
from django.conf import settings
from django.template.loader import render_to_string

EMAIL_ACCOUNTS = {
    'support': {
        'user': os.getenv('EMAIL_HOST_USER_SUPPORT'),
        'password': os.getenv('EMAIL_HOST_PASSWORD_SUPPORT')
    },
    'no-reply': {
        'user': os.getenv('EMAIL_HOST_USER_NOREPLY'),
        'password': os.getenv('EMAIL_HOST_PASSWORD_NOREPLY')
    },
    'wassup': {
        'user': os.getenv('EMAIL_HOST_USER_WASSUP'),
        'password': os.getenv('EMAIL_HOST_PASSWORD_WASSUP')
    },
}

def send_email(subject, body, to_emails, sender='wassup', html=False):
    """
    Send email from specified account
    
    Args:
        subject: Email subject
        body: Email body
        to_emails: List of recipient emails
        sender: Account to send from ('support', 'no-reply', 'wassup')
        html: Whether body is HTML content
    """
    account = EMAIL_ACCOUNTS.get(sender)
    if not account:
        raise ValueError(f"Invalid sender '{sender}' specified")

    connection = get_connection(
        host=os.getenv('EMAIL_HOST', 'mail.privateemail.com'),
        port=int(os.getenv('EMAIL_PORT', 465)),
        username=account['user'],
        password=account['password'],
        use_ssl=True
    )

    email = EmailMessage(
        subject=subject,
        body=body,
        from_email=account['user'],
        to=to_emails,
        connection=connection
    )

    if html:
        email.content_subtype = "html"

    return email.send()

def send_email_template(to_email, subject, template_name, context, sender='wassup', from_email=None):
    """
    Send email using template from specified account
    
    Args:
        to_email: Recipient email
        subject: Email subject
        template_name: Template name (without .html/.txt extension)
        context: Template context
        sender: Account to send from ('support', 'no-reply', 'wassup')
        from_email: Override from email (optional)
    """
    account = EMAIL_ACCOUNTS.get(sender)
    if not account:
        raise ValueError(f"Invalid sender '{sender}' specified")

    # Render templates
    html_content = render_to_string(f'emails/{template_name}.html', context)
    text_content = render_to_string(f'emails/{template_name}.txt', context)
    
    # Use provided from_email or account email
    from_email = from_email or account['user']
    
    connection = get_connection(
        host=os.getenv('EMAIL_HOST', 'mail.privateemail.com'),
        port=int(os.getenv('EMAIL_PORT', 465)),
        username=account['user'],
        password=account['password'],
        use_ssl=True
    )

    # Use EmailMultiAlternatives for HTML emails
    email = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=from_email,
        to=[to_email],
        connection=connection
    )
    email.attach_alternative(html_content, "text/html")
    
    return email.send()